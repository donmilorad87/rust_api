# Money Flow - Infrastructure

Docker-based infrastructure for the Money Flow application.

> **Application code is located in the `money_flow/` folder.** See [money_flow/README.md](money_flow/README.md) for application documentation.

---

## Project Structure

```
.
├── docker-compose.yml          # Orchestrates all services
├── .env                        # Environment variables for Docker
├── .env.example                # Example environment file
├── firewall-setup.sh           # UFW firewall configuration
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
├── redis/                      # Redis container (message queue)
│   ├── Dockerfile
│   ├── entrypoint.sh
│   └── redis.conf              # Redis configuration
│
├── nginx/                      # Nginx reverse proxy
│   ├── Dockerfile
│   └── default.conf.template   # SSL/HTTPS proxy config
│
└── money_flow/                 # APPLICATION SOURCE CODE
    └── README.md               # Application documentation
```

---

## Services

| Service  | Container IP  | Port  | Description                        |
|----------|---------------|-------|------------------------------------|
| rust     | 172.28.0.10   | 9999  | Actix-web application              |
| nginx    | 172.28.0.12   | 80/443| Reverse proxy with SSL             |
| postgres | 172.28.0.11   | 5432  | PostgreSQL database                |
| redis    | 172.28.0.13   | 6379  | Redis for message queue            |

### Network

All services run on a custom bridge network `devnet` with subnet `172.28.0.0/16`.

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

## Docker Commands

```bash
# Start services
docker compose up -d

# Stop services
docker compose down

# Restart specific service
docker compose restart rust

# Rebuild containers
docker compose up -d --build

# View logs
docker compose logs -f rust
docker compose logs -f postgres
docker compose logs -f redis

# Enter containers
docker compose exec rust bash
docker compose exec postgres psql -U app -d money_flow
docker compose exec redis redis-cli

# Remove volumes (WARNING: deletes data)
docker compose down -v
```

---

## Environment Variables

### Root `.env` (Docker)

```env
# Build mode
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

# Redis
REDIS_IP=172.28.0.13
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_USER=app
REDIS_PASSWORD=redis_secret_password
REDIS_DB=0

# Email (SMTP)
MAIL_MAILER=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USERNAME=user
MAIL_PASSWORD=pass
MAIL_FROM_ADDRESS=noreply@example.com
MAIL_FROM_NAME=MoneyFlow
```

### Environment Sync

The `rust/entrypoint.sh` automatically syncs environment variables from Docker to `money_flow/.env` on container startup.

---

## Build Modes

Set `BUILD_ENV` in `.env`:

### Development (`dev`)
- Hot reload with cargo-watch
- Auto-runs `cargo sqlx prepare` on file changes
- Debug logging enabled
- Source maps included

### Production (`prod`)
- Release build with optimizations
- Runs compiled binary directly
- Minimal logging
- No development tools

---

## Container Details

### Rust Container

- **Base**: `rust:latest`
- **Working dir**: `/home/rust/money_flow`
- **Volumes**:
  - `./money_flow` → `/home/rust/money_flow` (source code)
  - `cargo-cache` → `/usr/local/cargo/registry` (dependencies)
  - `target-cache` → `/home/rust/money_flow/target` (build cache)
- **Dev tools**: sqlx-cli, cargo-watch

### PostgreSQL Container

- **Base**: `postgres:latest`
- **Data volume**: `pgdata`
- **Config**: Custom `pg_hba.conf` and `postgresql.conf`
- **Auth**: Password authentication

### Redis Container

- **Base**: `redis:latest`
- **Data volume**: `redisdata`
- **Config**: Custom `redis.conf` with ACL
- **Auth**: Username/password authentication

### Nginx Container

- **Base**: `nginx:latest`
- **Ports**: 80 (HTTP → HTTPS redirect), 443 (HTTPS)
- **SSL**: Self-signed certificates (replace for production)
- **Proxy**: Routes to rust container on port 9999

---

## Volumes

| Volume       | Purpose                          |
|--------------|----------------------------------|
| pgdata       | PostgreSQL data persistence      |
| redisdata    | Redis data persistence           |
| cargo-cache  | Cargo registry cache             |
| target-cache | Rust build artifacts cache       |

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
- Block direct access to internal ports (5432, 6379, 9999)

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

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose logs rust

# Rebuild from scratch
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Database connection issues

```bash
# Check postgres is running
docker compose ps postgres

# Test connection
docker compose exec postgres pg_isready -U app -d money_flow

# Check logs
docker compose logs postgres
```

### Redis connection issues

```bash
# Test connection
docker compose exec redis redis-cli -a redis_secret_password ping

# Check logs
docker compose logs redis
```

### Permission issues

```bash
# Fix ownership (inside container)
chown -R rust:rust /home/rust/money_flow
```

### Stale files in container

```bash
# Restart to refresh volume mounts
docker compose restart rust
```
