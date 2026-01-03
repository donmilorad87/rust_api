# Overview and Architecture

## Project Overview

**Blazing Sun** - Docker-based infrastructure for a Rust web application (Actix-web + PostgreSQL + MongoDB + Redis + RabbitMQ + Kafka).

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
└── blazing_sun/                 # APPLICATION CODE (see blazing_sun/CLAUDE.md)
    ├── src/                    # Rust source code
    ├── migrations/             # SQLx database migrations
    ├── storage/                # File storage
    │   └── app/
    │       ├── public/         # Publicly accessible files (nginx serves)
    │       └── private/        # Private files (API serves)
    ├── Cargo.toml
    └── CLAUDE.md               # App-specific guidance
```
