# Blazing Sun - Infrastructure

**Production-ready Docker infrastructure** for the Blazing Sun web application featuring Rust (Actix-web), PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka, and comprehensive monitoring.

> **Application code is in `blazing_sun/` folder.** See [blazing_sun/README.md](blazing_sun/README.md) for application documentation.

---

## 🚀 Key Features

### Infrastructure Components
- ✅ **Multi-Service Orchestration** - Docker Compose with 12 services, automatic dependency management, health checks
- ✅ **Dual Database Architecture** - PostgreSQL for relational data, MongoDB for document storage
- ✅ **Dual Messaging Strategy** - RabbitMQ for task queues, Kafka (KRaft mode) for event streaming
- ✅ **Redis Caching** - Session storage, rate limiting, application cache
- ✅ **SSL/HTTPS Ready** - Nginx reverse proxy with automatic HTTP→HTTPS redirect
- ✅ **Static File Serving** - Nginx serves uploaded assets and frontend bundles
- ✅ **Monitoring Stack** - Prometheus metrics collection + Grafana dashboards
- ✅ **Admin Interfaces** - pgAdmin (PostgreSQL), Mongo Express (MongoDB), Kafka UI, RabbitMQ Management
- ✅ **Development Mode** - Hot reload with cargo-watch, SQLx prepare on file changes
- ✅ **Production Mode** - Optimized release builds, minimal logging
- ✅ **Custom Network** - Isolated Docker network (172.28.0.0/16) with static IPs
- ✅ **Volume Persistence** - Data persistence for all databases and caches

---

## 🛠️ Tech Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| **Application** | Rust (Actix-web) | Stable | Async web framework with WebSockets support |
| **Databases** | PostgreSQL | Latest | Primary relational database (users, transactions, uploads) |
| | MongoDB | Latest | Document database (analytics, logs, unstructured data) |
| **Cache** | Redis | Alpine | Session store, rate limiting, application cache |
| **Message Queue** | RabbitMQ | Management-Alpine | Async task processing (emails, jobs, notifications) |
| **Event Streaming** | Apache Kafka | Latest (KRaft) | Event sourcing, audit logs, real-time data pipelines |
| **Reverse Proxy** | Nginx | Alpine | SSL termination, static files, load balancing |
| **Monitoring** | Prometheus | Latest | Metrics collection and time-series storage |
| | Grafana | Latest | Monitoring dashboards and visualization |
| **Admin UIs** | pgAdmin | Latest | PostgreSQL database administration |
| | Mongo Express | Latest | MongoDB web-based admin interface |
| | Kafka UI | Latest | Kafka topic and message management |
| | RabbitMQ Management | Built-in | Queue monitoring and management |

---

## 📐 Architecture Overview

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

### Dual Messaging Strategy

| System    | Purpose                                        | Use Case                              |
|-----------|------------------------------------------------|---------------------------------------|
| RabbitMQ  | Task/Command processing (work queue)           | Emails, image resizing, background jobs|
| Kafka     | Event streaming (pub/sub, immutable log)       | Audit logs, analytics, notifications  |

**Why Both?**
- **RabbitMQ**: Reliable task distribution with acknowledgments, priority queues, dead-letter handling
- **Kafka**: Event sourcing, replay capability, high-throughput event pipelines, multiple consumers

---

## 📂 Project Structure

```
.
├── docker-compose.yml          # Service orchestration (12 containers)
├── .env                        # Docker environment variables
├── .env.example                # Example environment file
├── firewall-setup.sh           # UFW firewall config for production
├── CLAUDE.md                   # AI assistant guidance (infrastructure)
├── CLAUDE_partials/            # Detailed infrastructure documentation
│   ├── 01-overview-architecture.md
│   ├── 02-services-reference.md
│   ├── 03-message-brokers.md
│   ├── 04-docker-operations.md
│   ├── 05-environment-config.md
│   ├── 06-web-uis.md
│   ├── 07-troubleshooting.md
│   └── 08-tech-stack-extensions.md
├── README.md                   # This file
│
├── rust/                       # Rust container
│   ├── Dockerfile              # Multi-stage build (dev/prod)
│   ├── entrypoint.sh           # Syncs env vars, starts app
│   ├── cargo.config.toml       # Cargo network settings
│   ├── install.dev.sh          # Dev tools (sqlx-cli, cargo-watch)
│   └── install.prod.sh         # Production build script
│
├── postgres/                   # PostgreSQL container
│   ├── Dockerfile
│   ├── entrypoint.sh           # Database initialization
│   ├── pg_hba.conf             # Authentication config
│   └── postgresql.conf.template # PostgreSQL settings
│
├── mongo/                      # MongoDB container
│   ├── Dockerfile
│   ├── entrypoint.sh           # Database initialization
│   ├── startup.sh              # User creation script
│   └── mongod.conf.template    # MongoDB configuration
│
├── redis/                      # Redis container
│   ├── Dockerfile
│   ├── entrypoint.sh           # ACL user setup
│   └── redis.conf              # Memory, persistence config
│
├── rabbitmq/                   # RabbitMQ container
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── rabbitmq.conf           # Cluster, memory settings
│   └── definitions.json        # Pre-configured queues/exchanges
│
├── kafka/                      # Kafka container
│   ├── Dockerfile              # Apache Kafka (KRaft mode)
│   └── entrypoint.sh           # Topic creation on startup
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
├── mongo-express/              # MongoDB admin UI
│   ├── Dockerfile
│   └── entrypoint.sh
│
├── prometheus/                 # Prometheus monitoring
│   ├── Dockerfile
│   └── prometheus.yml          # Scrape configuration
│
├── grafana/                    # Grafana dashboards
│   ├── Dockerfile
│   ├── dashboards/
│   │   └── rabbitmq.json       # Pre-built RabbitMQ dashboard
│   └── provisioning/
│       ├── datasources/
│       │   └── datasources.yml # Prometheus datasource
│       └── dashboards/
│           └── dashboards.yml  # Dashboard provisioning
│
├── Documentation/              # Comprehensive documentation
│   └── blazing_sun/            # Application-specific docs
│       ├── Routes/
│       ├── Frontend/
│       ├── Backend/
│       └── ...
│
└── blazing_sun/                # APPLICATION SOURCE CODE
    ├── src/                    # Rust source code
    │   ├── app/                # Application layer
    │   │   ├── http/           # Controllers (API + Web)
    │   │   ├── db_query/       # Database queries
    │   │   └── mq/             # Message queue jobs/workers
    │   ├── bootstrap/          # Startup initialization
    │   ├── routes/             # Route definitions
    │   └── main.rs             # Entry point
    ├── migrations/             # SQLx database migrations
    ├── storage/                # File storage
    │   └── app/
    │       ├── public/         # Public files (nginx serves)
    │       └── private/        # Private files (auth required)
    ├── tests/                  # Integration and E2E tests
    ├── Cargo.toml              # Rust dependencies
    ├── README.md               # Application documentation (903 lines)
    └── CLAUDE.md               # Application AI guidance
```

---

## 🌐 Services

| Service       | IP           | Port(s)       | Healthcheck                          | Purpose                              |
|---------------|--------------|---------------|--------------------------------------|--------------------------------------|
| rust          | 172.28.0.10  | 9999          | -                                    | Actix-web application                |
| postgres      | 172.28.0.11  | 5432          | `pg_isready -U app -d blazing_sun`   | PostgreSQL database                  |
| nginx         | 172.28.0.12  | 80/443        | -                                    | SSL reverse proxy + static files     |
| redis         | 172.28.0.13  | 6379          | `redis-cli -a password ping`         | Cache/session store                  |
| rabbitmq      | 172.28.0.14  | 5672/15672    | `rabbitmq-diagnostics -q ping`       | Message queue (async tasks)          |
| prometheus    | 172.28.0.15  | 9090          | -                                    | Metrics collection                   |
| grafana       | 172.28.0.16  | 3000          | -                                    | Monitoring dashboards                |
| kafka         | 172.28.0.17  | 9092/9093     | Broker API + topics exist            | Event streaming (KRaft mode)         |
| kafka-ui      | 172.28.0.18  | 8080          | -                                    | Kafka management UI                  |
| pgadmin       | 172.28.0.19  | 5050          | -                                    | PostgreSQL admin panel               |
| mongo         | 172.28.0.20  | 27017         | `mongosh ping`                       | MongoDB document database            |
| mongo-express | 172.28.0.21  | 8081          | -                                    | MongoDB web admin                    |

**Network**: `devnet` (172.28.0.0/16) - Custom bridge network with static IP assignment

---

## 🚀 Quick Start

```bash
# Clone repository
git clone <repository-url>
cd rust

# Setup environment
cp .env.example .env
# Edit .env with your values

# Start all services
docker compose up -d

# View application logs
docker compose logs -f rust

# Check service status
docker compose ps

# Enter Rust container (for cargo commands, migrations)
docker compose exec rust bash
```

**First-Time Setup**:
```bash
# Inside rust container
cd blazing_sun

# Run database migrations
sqlx migrate run

# Verify database
sqlx migrate info
```

---

## 🔄 Startup Sequence

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
│         │          ┌──────────────┐         │                 │             │
│         │          │   MongoDB    │         │                 │             │
│         │          │ Healthcheck: │         │                 │             │
│         │          │mongosh ping  │         │                 │             │
│         │          └──────┬───────┘         │                 │             │
│         │                 │                 │                 │             │
│         └─────────────────┴─────────────────┴─────────────────┘             │
│                                     │                                        │
│                                     ▼                                        │
│  Phase 2: Application (waits for all Phase 1 services to be healthy)        │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                          Rust App                                 │       │
│  │   depends_on: postgres, redis, rabbitmq, kafka, mongo             │       │
│  │               (all with condition: service_healthy)                │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                     │                                        │
│                                     ▼                                        │
│  Phase 3: Proxy & UI Services (start after application ready)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │    Nginx     │  │   Kafka UI   │  │   pgAdmin    │  │Mongo Express │    │
│  │  (depends    │  │  (depends    │  │  (depends    │  │  (depends    │    │
│  │   on rust)   │  │   on kafka)  │  │ on postgres) │  │  on mongo)   │    │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘    │
│         │                                                        │            │
│  ┌──────────────┐                                                            │
│  │   Grafana    │                                                            │
│  │  (depends    │                                                            │
│  │on prometheus)│                                                            │
│  └──────────────┘                                                            │
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

# MongoDB - database operational
healthcheck:
  test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')", "--quiet"]
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s

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

## 🔧 Environment Variables

### Root `.env` (Docker Configuration)

Complete environment variable reference for docker-compose.yml:

```env
# ==========================================
# BUILD CONFIGURATION
# ==========================================
BUILD_ENV=dev                           # dev or prod

# ==========================================
# APPLICATION
# ==========================================
APP_PORT=9999

# ==========================================
# POSTGRESQL
# ==========================================
POSTGRES_IP=172.28.0.11
POSTGRES_USER=app
POSTGRES_PASSWORD=app_secret_password
POSTGRES_DB=blazing_sun
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

# ==========================================
# PGADMIN (PostgreSQL Admin Panel)
# ==========================================
PGADMIN_IP=172.28.0.19
PGADMIN_PORT=5050
PGADMIN_DEFAULT_EMAIL=admin@blazingsun.app
PGADMIN_DEFAULT_PASSWORD=pgadmin_secret_password

# ==========================================
# MONGODB
# ==========================================
MONGO_IP=172.28.0.20
MONGO_HOST=mongo
MONGO_PORT=27017
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=mongo_admin_password
MONGO_INITDB_DATABASE=blazing_sun
MONGO_USER=app
MONGO_PASSWORD=mongo_app_password

# ==========================================
# MONGO EXPRESS (MongoDB Admin UI)
# ==========================================
MONGO_EXPRESS_IP=172.28.0.21
MONGO_EXPRESS_PORT=8081
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASSWORD=mongoexpress_secret_password

# ==========================================
# REDIS
# ==========================================
REDIS_IP=172.28.0.13
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USER=app
REDIS_PASSWORD=redis_secret_password
REDIS_DB=0

# ==========================================
# RABBITMQ (Async Tasks)
# ==========================================
RABBITMQ_HOST=rabbitmq
RABBITMQ_PORT=5672
RABBITMQ_MANAGEMENT_PORT=15672
RABBITMQ_USER=app
RABBITMQ_PASSWORD=rabbitmq_secret_password
RABBITMQ_VHOST=/

# ==========================================
# KAFKA (Event Streaming)
# ==========================================
KAFKA_IP=172.28.0.17
KAFKA_HOST=kafka
KAFKA_PORT=9092
KAFKA_CONTROLLER_PORT=9093
KAFKA_BROKER_ID=1
KAFKA_CLUSTER_ID=MkU3OEVBNTcwNTJENDM2Qk
KAFKA_NUM_PARTITIONS=3
KAFKA_LOG_RETENTION_HOURS=168

# ==========================================
# KAFKA UI
# ==========================================
KAFKA_UI_IP=172.28.0.18
KAFKA_UI_PORT=8080
KAFKA_UI_CLUSTER_NAME=blazing-sun
KAFKA_UI_USER=admin
KAFKA_UI_PASSWORD=kafka_ui_secret_password

# ==========================================
# EMAIL (SMTP/Mailtrap)
# ==========================================
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_mailtrap_username
MAIL_PASSWORD=your_mailtrap_password
MAIL_FROM_ADDRESS=noreply@blazingsun.app
MAIL_FROM_NAME=BlazingSun

# ==========================================
# FILE UPLOADS
# ==========================================
UPLOAD_STORAGE_PATH=/home/rust/blazing_sun/storage/app
STORAGE_DRIVER=local
STORAGE_PUBLIC_URL=/storage
STORAGE_PRIVATE_URL=/api/v1/upload/private

# ==========================================
# MONITORING
# ==========================================
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

### Environment Sync

The `rust/entrypoint.sh` automatically syncs environment variables from Docker to `blazing_sun/.env` on container startup. This ensures the application always has the latest configuration.

**Synced Variables**: PORT, POSTGRES_*, REDIS_*, RABBITMQ_*, KAFKA_*, MONGO_*, MAIL_*, UPLOAD_*, STORAGE_*

---

## 🏗️ Build Modes

Set `BUILD_ENV` in `.env`:

### Development (`dev`)
- **Hot reload** with cargo-watch
- Auto-runs `cargo sqlx prepare` on file changes
- Debug logging enabled (`RUST_LOG=debug`)
- Source maps included
- SQLx compile-time verification
- Development tools: sqlx-cli, cargo-watch

### Production (`prod`)
- **Release build** with optimizations (`--release`)
- Runs compiled binary directly
- Minimal logging (`RUST_LOG=info`)
- No development tools
- Smaller image size
- Faster startup time

**Switch modes**: Edit `BUILD_ENV` in `.env`, then:
```bash
docker compose down
docker compose build --no-cache rust
docker compose up -d
```

---

## 🐳 Docker Commands

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
docker compose logs -f mongo

# View logs for multiple services
docker compose logs -f rust postgres redis

# View last 100 lines of logs
docker compose logs --tail=100 rust
```

### Container Access

```bash
# Enter Rust container (for cargo commands, migrations)
docker compose exec rust bash

# PostgreSQL CLI
docker compose exec postgres psql -U app -d blazing_sun

# MongoDB CLI
docker compose exec mongo mongosh -u app -p mongo_app_password --authenticationDatabase blazing_sun

# Redis CLI
docker compose exec redis redis-cli -a redis_secret_password

# RabbitMQ status
docker compose exec rabbitmq rabbitmqctl status

# List RabbitMQ queues
docker compose exec rabbitmq rabbitmqctl list_queues

# Kafka topics
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Kafka consume messages (for debugging)
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning
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

### Database Operations

```bash
# PostgreSQL: Run migrations
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate run"

# PostgreSQL: Rollback migration
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate revert"

# PostgreSQL: Check migration status
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate info"

# PostgreSQL: Backup database
docker compose exec postgres pg_dump -U app blazing_sun > backup.sql

# PostgreSQL: Restore database
cat backup.sql | docker compose exec -T postgres psql -U app -d blazing_sun

# MongoDB: Backup database
docker compose exec mongo mongodump --username app --password mongo_app_password --authenticationDatabase blazing_sun --out=/backup

# MongoDB: Restore database
docker compose exec mongo mongorestore --username app --password mongo_app_password --authenticationDatabase blazing_sun /backup
```

---

## 📦 Container Details

### Rust Container
- **Base**: `debian:bookworm-slim` + rustup stable
- **Working dir**: `/home/rust/blazing_sun`
- **Entry point**: `rust/entrypoint.sh` (syncs env vars, starts app)
- **Dev mode**: Runs cargo-watch with hot reload
- **Prod mode**: Runs compiled binary
- **Volumes**:
  - `./blazing_sun` → `/home/rust/blazing_sun` (source code)
  - `cargo-cache` → `/usr/local/cargo/registry` (dependencies)
  - `target-cache` → `/home/rust/blazing_sun/target` (build cache)
- **Dev tools**: sqlx-cli, cargo-watch
- **Ports**: 9999 (internal)

### PostgreSQL Container
- **Base**: `postgres:latest`
- **Data volume**: `pgdata` → `/var/lib/postgresql`
- **Config**: Custom `pg_hba.conf` and `postgresql.conf`
- **Healthcheck**: `pg_isready -U app -d blazing_sun`
- **Database**: `blazing_sun` (auto-created)
- **User**: `app` (app-specific user)
- **Ports**: 5432

### MongoDB Container
- **Base**: `mongo:latest`
- **Data volume**: `mongodata` → `/data/db`
- **Config**: Custom `mongod.conf.template`
- **Healthcheck**: `mongosh ping`
- **Database**: `blazing_sun` (auto-created)
- **Root user**: `admin` (for admin operations)
- **App user**: `app` (application-specific user)
- **Ports**: 27017
- **Startup script**: Creates database and app user automatically

### Redis Container
- **Base**: `redis:alpine`
- **Data volume**: `redisdata` → `/data`
- **Config**: Custom `redis.conf` with ACL authentication
- **Healthcheck**: `redis-cli -a password ping`
- **User**: `app` (ACL-based authentication)
- **Persistence**: RDB + AOF enabled
- **Ports**: 6379

### RabbitMQ Container
- **Base**: `rabbitmq:management-alpine`
- **Data volume**: `rabbitmqdata` → `/var/lib/rabbitmq`
- **Config**: Custom `rabbitmq.conf`
- **Definitions**: Pre-configured queues and exchanges (`definitions.json`)
- **Management UI**: http://localhost:15672
- **Healthcheck**: `rabbitmq-diagnostics -q ping`
- **User**: `app` (full permissions on `/` vhost)
- **Ports**: 5672 (AMQP), 15672 (Management), 15692 (Prometheus metrics)
- **Purpose**: Async task queue (emails, image resizing, user creation)

### Kafka Container
- **Base**: `apache/kafka:latest`
- **Data volume**: `kafkadata` → `/var/lib/kafka/data`
- **Mode**: KRaft (no Zookeeper required)
- **Healthcheck**: Broker API ready + `user.events` topic exists
- **Topics created on startup**:
  - `user.events` (3 partitions, 7-day retention)
  - `auth.events` (3 partitions, 7-day retention)
  - `transaction.events` (3 partitions, 7-day retention)
  - `category.events` (3 partitions, 7-day retention)
  - `system.events` (3 partitions, 7-day retention)
  - `events.dead_letter` (3 partitions, 7-day retention)
- **Ports**: 9092 (broker), 9093 (controller)
- **Purpose**: Event sourcing, audit logs, real-time data pipelines

### Kafka UI Container
- **Base**: `provectuslabs/kafka-ui:latest`
- **Port**: 8080
- **Context path**: `/kafka`
- **Authentication**: LOGIN_FORM (username/password)
- **User**: `admin`
- **Purpose**: Kafka topic/message management, consumer group monitoring
- **Features**: View messages, create topics, manage consumer groups

### Nginx Container
- **Base**: `nginx:alpine`
- **Ports**: 80 (HTTP→HTTPS redirect), 443 (HTTPS)
- **SSL**: Self-signed certificates (replace for production)
- **Proxy**: Routes to rust container on port 9999
- **Static files**: Serves from `blazing_sun/src/storage/app/public/`
- **Assets**: Serves CSS/JS from `blazing_sun/src/resources/`
- **Config**: `default.conf.template` with environment variable substitution
- **Volumes**:
  - `./blazing_sun/src/storage/app/public` → `/var/www/storage/public` (read-only)
  - `./blazing_sun/src/resources/css` → `/var/www/assets/css` (read-only)
  - `./blazing_sun/src/resources/js` → `/var/www/assets/js` (read-only)

### pgAdmin Container
- **Base**: `dpage/pgadmin4:latest`
- **Data volume**: `pgadmindata` → `/var/lib/pgadmin`
- **Port**: 5050
- **Context path**: `/pgadmin`
- **Purpose**: PostgreSQL database administration
- **Pre-configured**: Server connection to postgres container
- **Config**: `servers.json` with automatic connection setup
- **User**: `admin@blazingsun.app`

### Mongo Express Container
- **Base**: `mongo-express:latest`
- **Port**: 8081
- **Context path**: `/mongo/`
- **Purpose**: MongoDB web-based admin interface
- **Authentication**: Basic auth (username/password)
- **User**: `admin`
- **Features**: View/edit documents, manage databases, run queries

### Prometheus Container
- **Base**: `prom/prometheus:latest`
- **Data volume**: `prometheusdata` → `/prometheus`
- **Port**: 9090
- **Config**: `prometheus.yml` with scrape targets
- **Purpose**: Metrics collection from RabbitMQ and other services
- **Retention**: 15 days (default)
- **Scrape interval**: 15 seconds

### Grafana Container
- **Base**: `grafana/grafana:latest`
- **Data volume**: `grafanadata` → `/var/lib/grafana`
- **Port**: 3000
- **Context path**: `/grafana/`
- **Purpose**: Monitoring dashboards and visualization
- **Pre-configured**:
  - Prometheus datasource
  - RabbitMQ dashboard
- **User**: `admin` / `admin` (change in production)

---

## 💾 Volumes

| Volume         | Purpose                          | Container Path          | Persistence |
|----------------|----------------------------------|-------------------------|-------------|
| pgdata         | PostgreSQL data                  | /var/lib/postgresql     | Critical    |
| mongodata      | MongoDB data                     | /data/db                | Critical    |
| redisdata      | Redis data                       | /data                   | Important   |
| rabbitmqdata   | RabbitMQ data                    | /var/lib/rabbitmq       | Important   |
| kafkadata      | Kafka logs and data              | /var/lib/kafka/data     | Important   |
| cargo-cache    | Cargo registry cache             | /usr/local/cargo/registry | Performance |
| target-cache   | Rust build artifacts             | /home/rust/blazing_sun/target | Performance |
| prometheusdata | Prometheus metrics storage       | /prometheus             | Important   |
| grafanadata    | Grafana dashboards and config    | /var/lib/grafana        | Important   |
| pgadmindata    | pgAdmin configuration            | /var/lib/pgadmin        | Optional    |

**Backup Priority**:
1. **Critical**: Database data (pgdata, mongodata) - Back up regularly
2. **Important**: Message queues, Kafka logs, monitoring data - Back up periodically
3. **Performance**: Build caches - Can be regenerated, no backup needed
4. **Optional**: UI configurations - Can be reconfigured

---

## 🎯 Event-Driven Architecture

### Kafka Topics

| Topic                | Events                                          | Partitions | Retention |
|----------------------|-------------------------------------------------|------------|-----------|
| `user.events`        | created, updated, deleted, activated            | 3          | 7 days    |
| `auth.events`        | sign_in, sign_in_failed, sign_out               | 3          | 7 days    |
| `transaction.events` | created, updated, deleted                       | 3          | 7 days    |
| `category.events`    | created, updated, deleted                       | 3          | 7 days    |
| `system.events`      | health_check, error, warning                    | 3          | 7 days    |
| `events.dead_letter` | Failed events (for reprocessing)                | 3          | 7 days    |

**Event Schema**:
```json
{
  "event_id": "uuid",
  "event_type": "user.created",
  "timestamp": "2026-01-02T14:30:00Z",
  "aggregate_id": "user-123",
  "aggregate_type": "user",
  "data": {
    "user_id": 123,
    "email": "user@example.com"
  },
  "metadata": {
    "source": "api",
    "user_agent": "..."
  }
}
```

### RabbitMQ Jobs

| Job             | Description                              | Priority | Queue      |
|-----------------|------------------------------------------|----------|------------|
| `send_email`    | Send email via SMTP (activation, reset)  | 1-5      | emails     |
| `resize_image`  | Generate image variants (5 sizes)        | 1-5      | images     |
| `create_user`   | Background user creation tasks           | 1-5      | users      |

**Priority Levels**:
- 1 = High (avatars, critical emails)
- 5 = Standard (bulk operations)

**Fault Tolerance**: 3 automatic retries + dead-letter queue

See [blazing_sun/README.md](blazing_sun/README.md) for implementation details.

---

## 🌐 Web UIs

| Service        | URL                                  | Credentials                          | Purpose |
|----------------|--------------------------------------|--------------------------------------|---------|
| **Application**| https://localhost/                   | -                                    | Main web app |
| **RabbitMQ**   | http://localhost:15672               | app / rabbitmq_secret_password       | Queue management |
| **Kafka UI**   | http://localhost:8080/kafka          | admin / kafka_ui_secret_password     | Kafka topics/messages |
| **pgAdmin**    | http://localhost:5050/pgadmin        | admin@blazingsun.app / pgadmin_secret_password | PostgreSQL admin |
| **Mongo Express** | http://localhost:8081/mongo/      | admin / mongoexpress_secret_password | MongoDB admin |
| **Grafana**    | https://localhost/grafana/           | admin / admin                        | Monitoring dashboards |
| **Prometheus** | http://localhost:9090                | -                                    | Metrics viewer |

**Note**: Change default passwords in production!

---

## 🔒 SSL Certificates

### Development
Uses self-signed certificates generated in the nginx container on first startup.

**Browser Warning**: You'll see "Your connection is not private" warnings. This is expected for self-signed certificates.

### Production

**Option 1: Let's Encrypt (Recommended)**
```bash
# Install certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates to nginx
docker cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem rust-nginx-1:/etc/nginx/ssl/cert.pem
docker cp /etc/letsencrypt/live/yourdomain.com/privkey.pem rust-nginx-1:/etc/nginx/ssl/key.pem

# Restart nginx
docker compose restart nginx
```

**Option 2: Volume Mount (Better for Production)**

Add to `docker-compose.yml` nginx service:
```yaml
volumes:
  - /etc/letsencrypt/live/yourdomain.com/fullchain.pem:/etc/nginx/ssl/cert.pem:ro
  - /etc/letsencrypt/live/yourdomain.com/privkey.pem:/etc/nginx/ssl/key.pem:ro
```

**Auto-renewal**:
```bash
# Add to crontab
0 3 * * * certbot renew --quiet && docker compose restart nginx
```

---

## 🔥 Firewall Setup

For production servers, run the firewall setup script:

```bash
sudo ./firewall-setup.sh
```

**UFW Configuration**:
- ✅ Allow SSH (22)
- ✅ Allow HTTP (80)
- ✅ Allow HTTPS (443)
- ❌ Block direct access to internal ports:
  - 5432 (PostgreSQL)
  - 27017 (MongoDB)
  - 6379 (Redis)
  - 5672 (RabbitMQ)
  - 9092 (Kafka)
  - 9999 (Rust app)
  - 5050 (pgAdmin)
  - 8081 (Mongo Express)

**Verify**:
```bash
sudo ufw status verbose
```

---

## 🐛 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs <service-name>

# Check healthcheck status
docker compose ps

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database Connection Issues

**PostgreSQL**:
```bash
# Check postgres is healthy
docker compose ps postgres

# Test connection
docker compose exec postgres pg_isready -U app -d blazing_sun

# View logs
docker compose logs postgres

# Manual connection test
docker compose exec postgres psql -U app -d blazing_sun -c "SELECT 1;"
```

**MongoDB**:
```bash
# Check mongo is healthy
docker compose ps mongo

# Test connection
docker compose exec mongo mongosh -u app -p mongo_app_password --authenticationDatabase blazing_sun --eval "db.adminCommand('ping')"

# View logs
docker compose logs mongo
```

### Redis Connection Issues

```bash
# Test connection
docker compose exec redis redis-cli -a redis_secret_password ping

# Check memory usage
docker compose exec redis redis-cli -a redis_secret_password INFO memory

# View logs
docker compose logs redis
```

### RabbitMQ Connection Issues

```bash
# Check status
docker compose exec rabbitmq rabbitmqctl status

# List queues
docker compose exec rabbitmq rabbitmqctl list_queues

# List connections
docker compose exec rabbitmq rabbitmqctl list_connections

# View logs
docker compose logs rabbitmq

# Check if definitions loaded
docker compose exec rabbitmq rabbitmqctl list_exchanges
```

### Kafka Connection Issues

```bash
# Check broker status
docker compose exec kafka /opt/kafka/bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# List topics (should show user.events, auth.events, etc.)
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092

# Describe topic
docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --describe --topic user.events --bootstrap-server localhost:9092

# Consume messages (for debugging)
docker compose exec kafka /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic user.events \
    --from-beginning

# View logs
docker compose logs kafka
```

### Rust App Not Starting

```bash
# Check if waiting for dependencies
docker compose logs rust | grep -i "waiting\|healthy\|error"

# Check all dependencies are healthy
docker compose ps | grep -E "postgres|redis|rabbitmq|kafka|mongo"

# Verify environment variables synced
docker compose exec rust cat /home/rust/blazing_sun/.env

# Check compilation errors
docker compose logs rust | grep -i "error\|failed"
```

### Stale Files in Container

```bash
# Restart to refresh volume mounts
docker compose restart rust

# Force recreate container
docker compose up -d --force-recreate rust
```

### Permission Issues

```bash
# Fix ownership of project files (on host)
sudo chown -R $USER:$USER ./blazing_sun

# Fix permissions inside container
docker compose exec rust chown -R rust:rust /home/rust/blazing_sun
```

### Full Reset (Nuclear Option)

```bash
# Stop all containers
docker compose down

# Remove all volumes (WARNING: destroys all data)
docker compose down -v

# Remove all images
docker compose down --rmi all

# Clean Docker system
docker system prune -a --volumes

# Rebuild everything
docker compose build --no-cache
docker compose up -d
```

---

## 📚 Documentation

### Application Documentation
- [Application README](blazing_sun/README.md) - Complete application documentation (903 lines)
- [Application CLAUDE.md](blazing_sun/CLAUDE.md) - AI assistant guidance for application code

### Infrastructure Documentation
- [Overview & Architecture](CLAUDE_partials/01-overview-architecture.md) - System overview and architecture diagram
- [Services Reference](CLAUDE_partials/02-services-reference.md) - Service IPs, ports, startup sequence
- [Message Brokers](CLAUDE_partials/03-message-brokers.md) - RabbitMQ and Kafka usage patterns
- [Docker Operations](CLAUDE_partials/04-docker-operations.md) - Comprehensive Docker command reference
- [Environment Config](CLAUDE_partials/05-environment-config.md) - Environment variables and configuration
- [Web UIs](CLAUDE_partials/06-web-uis.md) - Access URLs and credentials for all admin interfaces
- [Troubleshooting](CLAUDE_partials/07-troubleshooting.md) - Common issues and solutions
- [Tech Stack & Extensions](CLAUDE_partials/08-tech-stack-extensions.md) - Adding services, topics, scaling

### Feature-Specific Documentation
- [Routes Documentation](Documentation/blazing_sun/Routes/) - Web and API route documentation
- [Frontend Documentation](Documentation/blazing_sun/Frontend/) - Frontend architecture and build system
- [Admin Uploads](Documentation/blazing_sun/AdminUploads/) - File upload system and image variants
- [Profile Page](Documentation/blazing_sun/ProfilePage/) - User profile management

---

## 🚀 Development Workflow

### Daily Development

```bash
# 1. Start infrastructure
docker compose up -d

# 2. View application logs
docker compose logs -f rust

# 3. Make code changes (hot reload in dev mode)
# Edit files in blazing_sun/src/

# 4. Run migrations if schema changed
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate run"

# 5. Test changes in browser
# Open https://localhost/

# 6. View RabbitMQ jobs (if testing async tasks)
# Open http://localhost:15672

# 7. View Kafka events (if testing event streaming)
# Open http://localhost:8080/kafka
```

### Running Tests

```bash
# Inside rust container
docker compose exec rust bash

# Run integration tests
cd blazing_sun
cargo test --test integration

# Run E2E tests
npx playwright test

# Run specific test
cargo test --test integration -- routes::api::SIGN_IN
```

### Database Migrations

```bash
# Create new migration
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate add create_new_table"

# Edit migration file
# blazing_sun/migrations/<timestamp>_create_new_table.sql

# Run migrations
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate run"

# Rollback last migration
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate revert"

# Check migration status
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate info"
```

---

## 📦 Adding New Services

### Example: Adding ElasticSearch

1. **Create service directory**:
```bash
mkdir elasticsearch
```

2. **Create Dockerfile**:
```dockerfile
# elasticsearch/Dockerfile
FROM docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

3. **Add to docker-compose.yml**:
```yaml
elasticsearch:
  build:
    context: ./elasticsearch
  image: elasticsearch-search
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
  volumes:
    - elasticsearchdata:/usr/share/elasticsearch/data
  ports:
    - "9200:9200"
  networks:
    devnet:
      ipv4_address: 172.28.0.22
```

4. **Add volume**:
```yaml
volumes:
  elasticsearchdata:
```

5. **Add environment variables** to `.env`:
```env
ELASTICSEARCH_IP=172.28.0.22
ELASTICSEARCH_PORT=9200
```

6. **Update rust service dependencies**:
```yaml
depends_on:
  elasticsearch:
    condition: service_started
```

7. **Rebuild**:
```bash
docker compose build --no-cache
docker compose up -d
```

---

## 🌍 Production Deployment

### Pre-Deployment Checklist

- [ ] Change all default passwords in `.env`
- [ ] Replace self-signed SSL certificates with Let's Encrypt or commercial certs
- [ ] Set `BUILD_ENV=prod` in `.env`
- [ ] Configure firewall with `./firewall-setup.sh`
- [ ] Set up automated backups for databases
- [ ] Configure log rotation
- [ ] Set up monitoring alerts in Grafana
- [ ] Test database restore procedures
- [ ] Configure proper SMTP server (replace Mailtrap)
- [ ] Set up domain DNS records
- [ ] Configure Kafka and RabbitMQ for high availability if needed
- [ ] Review and harden RabbitMQ, Redis ACLs
- [ ] Set up automated SSL certificate renewal
- [ ] Configure proper CORS origins in application
- [ ] Enable rate limiting in application
- [ ] Review and configure MongoDB security
- [ ] Test failover scenarios
- [ ] Document incident response procedures

### Deployment Steps

```bash
# 1. Clone repository on production server
git clone <repository-url> /opt/blazing-sun
cd /opt/blazing-sun

# 2. Configure environment
cp .env.example .env
nano .env
# Set BUILD_ENV=prod and update all passwords

# 3. Configure firewall
sudo ./firewall-setup.sh

# 4. Build and start services
docker compose build --no-cache
docker compose up -d

# 5. Run database migrations
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate run"

# 6. Install SSL certificates
sudo certbot certonly --standalone -d yourdomain.com
docker cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem rust-nginx-1:/etc/nginx/ssl/cert.pem
docker cp /etc/letsencrypt/live/yourdomain.com/privkey.pem rust-nginx-1:/etc/nginx/ssl/key.pem
docker compose restart nginx

# 7. Set up automatic SSL renewal
echo "0 3 * * * certbot renew --quiet && docker compose -f /opt/blazing-sun/docker-compose.yml restart nginx" | sudo crontab -

# 8. Verify all services are healthy
docker compose ps
```

### Backup Strategy

**Daily Backups**:
```bash
#!/bin/bash
# /opt/blazing-sun/backup.sh

BACKUP_DIR="/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# PostgreSQL backup
docker compose exec -T postgres pg_dump -U app blazing_sun > "$BACKUP_DIR/postgres.sql"

# MongoDB backup
docker compose exec mongo mongodump --username app --password mongo_app_password --authenticationDatabase blazing_sun --out="$BACKUP_DIR/mongo"

# Uploaded files backup
tar -czf "$BACKUP_DIR/uploads.tar.gz" ./blazing_sun/storage/app/

# Retain last 7 days
find /backups -type d -mtime +7 -exec rm -rf {} +
```

**Crontab**:
```bash
0 2 * * * /opt/blazing-sun/backup.sh
```

---

## 📄 License

[Your License Here]

---

**Last Updated**: 2026-01-02
**Infrastructure Version**: 1.0
**Total Services**: 12 containers
**Network**: devnet (172.28.0.0/16)
