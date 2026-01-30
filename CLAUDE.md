# CLAUDE.md - Infrastructure Guide

This file provides guidance to Claude Code when working with the infrastructure in this repository.

> **Application code is in `blazing_sun/` folder.** See `blazing_sun/CLAUDE.md` for application-specific guidance.

---

## Quick Reference

### Infrastructure Overview
- **13 Services** running in Docker Compose
- **Custom Bridge Network**: `devnet` (172.28.0.0/16)
- **3-Phase Startup Sequence** with healthcheck dependencies
- **Dual Database Architecture**: PostgreSQL + MongoDB
- **Dual Messaging Strategy**: RabbitMQ (tasks) + Kafka (events)
- **SSL/HTTPS**: Nginx reverse proxy with Let's Encrypt support

### Tech Stack
| Component | Technology |
|-----------|------------|
| Application | Actix-web (Rust) |
| Databases | PostgreSQL 17, MongoDB 8 |
| Cache | Redis 7 |
| Message Queue | RabbitMQ 4.0 (task processing) |
| Event Streaming | Apache Kafka 3.9 (KRaft mode) |
| Proxy | Nginx 1.27 (SSL + static files) |
| Monitoring | Prometheus + Grafana |
| Management UIs | pgAdmin, Mongo Express, Kafka UI, RabbitMQ Management |

---

## Services & Network

| Service | IP | Port(s) | URL | Purpose |
|---------|-------|---------|-----|---------|
| **rust** | 172.28.0.10 | 9999 | https://localhost/ | Actix-web application |
| **postgres** | 172.28.0.11 | 5432 | - | PostgreSQL database |
| **nginx** | 172.28.0.12 | 80/443 | https://localhost/ | SSL reverse proxy |
| **redis** | 172.28.0.13 | 6379 | - | Cache/session store |
| **rabbitmq** | 172.28.0.14 | 5672/15672 | http://localhost:15672 | Message queue |
| **prometheus** | 172.28.0.15 | 9090 | http://localhost:9090 | Metrics collection |
| **grafana** | 172.28.0.16 | 3000 | https://localhost/grafana/ | Monitoring dashboards |
| **kafka** | 172.28.0.17 | 9092/9093 | - | Event streaming |
| **kafka-ui** | 172.28.0.18 | 8080 | http://localhost:8080/kafka | Kafka management |
| **pgadmin** | 172.28.0.19 | 5050 | http://localhost:5050/pgadmin | PostgreSQL admin |
| **mongo** | 172.28.0.20 | 27017 | - | MongoDB database |
| **mongo-express** | 172.28.0.21 | 8081 | http://localhost:8081/mongo/ | MongoDB admin |
| **php-oauth** | 172.28.0.22 | 8889 | https://localhost:8889 | OAuth callback test service |

For admin credentials, see [CLAUDE_partials/06-web-uis.md](CLAUDE_partials/06-web-uis.md).

---

## Most Common Commands

### Basic Operations
```bash
# Start all services
docker compose up -d

# View logs (follow mode)
docker compose logs -f rust

# Restart application
docker compose restart rust

# Stop all services
docker compose down

# Enter Rust container
docker compose exec rust bash
```

### Database Operations
```bash
# PostgreSQL: Run migrations
docker compose exec rust bash -c "cd blazing_sun && sqlx migrate run"

# PostgreSQL: CLI access
docker compose exec postgres psql -U app -d blazing_sun

# MongoDB: CLI access
docker compose exec mongo mongosh -u app -p mongo_app_password --authenticationDatabase blazing_sun
```

### Full Rebuild
```bash
# Complete rebuild (removes volumes)
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

For more commands, see [CLAUDE_partials/04-docker-operations.md](CLAUDE_partials/04-docker-operations.md).

---

## Detailed Documentation (CLAUDE_partials/)

All detailed infrastructure documentation is organized in the `CLAUDE_partials/` folder:

| File | Description |
|------|-------------|
| [01-overview-architecture.md](CLAUDE_partials/01-overview-architecture.md) | System overview, architecture diagram, infrastructure structure |
| [02-services-reference.md](CLAUDE_partials/02-services-reference.md) | All services with IPs, ports, healthchecks, startup sequence |
| [03-message-brokers.md](CLAUDE_partials/03-message-brokers.md) | RabbitMQ vs Kafka usage patterns, when to use which |
| [04-docker-operations.md](CLAUDE_partials/04-docker-operations.md) | All Docker commands (start, stop, logs, rebuild, CLI access) |
| [05-environment-config.md](CLAUDE_partials/05-environment-config.md) | .env structure, build modes, volumes, sync mechanism |
| [06-web-uis.md](CLAUDE_partials/06-web-uis.md) | Admin interfaces, credentials, SSL certificates |
| [07-troubleshooting.md](CLAUDE_partials/07-troubleshooting.md) | Common issues, database problems, performance debugging |
| [08-tech-stack-extensions.md](CLAUDE_partials/08-tech-stack-extensions.md) | Adding services, Kafka topics, volumes, scaling |

---

## Additional Documentation

### Infrastructure Deep Dive
- **[README.md](README.md)** - Complete infrastructure guide (1300+ lines)
- **[Documentation/docker_infrastructure/INFRASTRUCTURE.md](Documentation/docker_infrastructure/INFRASTRUCTURE.md)** - Architecture deep dive

### Game Documentation
- **[Documentation/Games/ROULETTE.md](Documentation/Games/ROULETTE.md)** - Roulette game implementation

### Application Documentation
- **[blazing_sun/CLAUDE.md](blazing_sun/CLAUDE.md)** - Application-specific guidance

---

## Startup Sequence

**Phase 1: Infrastructure** (healthcheck required before Phase 2)
- PostgreSQL, MongoDB, Redis, RabbitMQ, Kafka

**Phase 2: Application**
- Rust application (depends on Phase 1)

**Phase 3: Management UIs**
- Nginx, pgAdmin, Mongo Express, Kafka UI, Grafana, Prometheus

See [CLAUDE_partials/02-services-reference.md](CLAUDE_partials/02-services-reference.md) for detailed startup dependencies.

---

## Event-Driven Architecture

### RabbitMQ (Task Queue)
- **Purpose**: Background job processing
- **Jobs**: send_email, send_sms, resize_image, create_user, send_notification
- **Priority**: 1 (high) to 5 (standard)
- **Fault Tolerance**: 3 retries + dead-letter queue

### Kafka (Event Streaming)
- **Purpose**: Event sourcing, audit logging, real-time data pipelines
- **Topics**: user_events, transaction_events, system_events, roulette.*
- **Partitions**: 3 per topic
- **Retention**: 7 days
- **Mode**: KRaft (no Zookeeper)

See [CLAUDE_partials/03-message-brokers.md](CLAUDE_partials/03-message-brokers.md) for usage patterns.

---

## Docker Volumes

| Volume | Purpose | Backup Priority |
|--------|---------|-----------------|
| `pgdata` | PostgreSQL data | **CRITICAL** |
| `mongodata` | MongoDB data | **CRITICAL** |
| `redisdata` | Redis cache | Medium |
| `kafka_data` | Kafka logs | High |
| `rabbitmq_data` | RabbitMQ queues | High |
| `uploads` | User uploads | **CRITICAL** |
| `target` | Rust build cache | Low (regenerable) |
| `cargo_registry` | Cargo registry cache | Low (regenerable) |
| `cargo_git` | Cargo git cache | Low (regenerable) |
| `frontend_node_modules` | Node modules cache | Low (regenerable) |

See [README.md](README.md) for backup strategies and restoration procedures.

---

## Environment Variables

Environment variables are defined in root `.env` file and automatically synced to `blazing_sun/.env` by `rust/entrypoint.sh`.

**Key Environment Groups**:
- Application (host, port, JWT secrets)
- PostgreSQL (host, port, credentials, database)
- MongoDB (host, port, credentials, database)
- Redis (host, port, password)
- RabbitMQ (host, port, credentials)
- Kafka (host, port, bootstrap servers)
- Nginx (SSL, domain)
- Admin UIs (pgAdmin, Mongo Express, Kafka UI, Grafana credentials)

See [CLAUDE_partials/05-environment-config.md](CLAUDE_partials/05-environment-config.md) for complete .env reference.

---

## Development Workflow

1. **Make changes** to code in `blazing_sun/`
2. **Hot reload** automatically picks up changes (dev mode with cargo-watch)
3. **View logs**: `docker compose logs -f rust`
4. **Restart if needed**: `docker compose restart rust`
5. **Run migrations**: `docker compose exec rust bash -c "cd blazing_sun && sqlx migrate run"`
6. **Frontend builds**: Each page has its own Vite build in `src/frontend/pages/`

---

## Getting Help

| Topic | Documentation |
|-------|---------------|
| Infrastructure Issues | [CLAUDE_partials/07-troubleshooting.md](CLAUDE_partials/07-troubleshooting.md) |
| Application Issues | [blazing_sun/CLAUDE.md](blazing_sun/CLAUDE.md) |
| Docker Commands | [CLAUDE_partials/04-docker-operations.md](CLAUDE_partials/04-docker-operations.md) |
| Configuration | [CLAUDE_partials/05-environment-config.md](CLAUDE_partials/05-environment-config.md) |
| Complete Guide | [README.md](README.md) |

---

## Production Deployment

See [README.md](README.md) for complete 16-point production checklist including:
- SSL certificates (Let's Encrypt)
- Firewall configuration (UFW)
- Environment variables security
- Database backup automation
- Volume backup strategies
- Monitoring and alerting
- Log rotation
- Performance tuning
