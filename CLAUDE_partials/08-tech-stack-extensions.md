# Technology Stack & Extensions

## Technology Versions

All services use `:latest` or `:alpine` tags with system updates during build:

| Service | Base Image | Notes |
|---------|-----------|-------|
| Rust | debian:bookworm-slim + rustup stable | Multi-stage build (dev/prod) |
| PostgreSQL | postgres:latest | Latest stable release |
| Redis | redis:alpine | Minimal Alpine-based image |
| RabbitMQ | rabbitmq:management-alpine | Includes management UI |
| Kafka | apache/kafka:latest | KRaft mode (no Zookeeper) |
| Kafka UI | provectuslabs/kafka-ui:latest | Web-based Kafka management |
| Nginx | nginx:alpine | Minimal Alpine-based image |
| pgAdmin | dpage/pgadmin4:latest | PostgreSQL admin panel |
| Grafana | grafana/grafana:latest | Monitoring dashboards |
| Prometheus | prom/prometheus:latest | Metrics collection |

**Update strategy**: All images are pulled on build. Run `docker compose build --no-cache` to get latest versions.

---

## Adding New Infrastructure

### Adding a New Docker Service

1. **Create service folder and files**:
   ```
   <service>/
   ├── Dockerfile
   └── entrypoint.sh
   ```

2. **Add service to `docker-compose.yml`**:
   ```yaml
   <service>:
     container_name: rust-<service>-1
     build:
       context: ./<service>
       dockerfile: Dockerfile
     networks:
       devnet:
         ipv4_address: 172.28.0.XX  # Pick unused IP
     volumes:
       - <service>data:/data
     healthcheck:
       test: ["CMD", "<health-command>"]
       interval: 10s
       timeout: 5s
       retries: 5
   ```

3. **Add to volumes section** (if persistent data needed):
   ```yaml
   volumes:
     <service>data:
   ```

4. **Add environment variables** to `.env` and `.env.example`:
   ```env
   SERVICE_IP=172.28.0.XX
   SERVICE_PORT=XXXX
   SERVICE_USER=user
   SERVICE_PASSWORD=password
   ```

5. **Update dependencies**: If other services depend on this service, add to their `depends_on` section:
   ```yaml
   depends_on:
     <service>:
       condition: service_healthy
   ```

6. **Update documentation**:
   - Add to services table in `02-services-reference.md`
   - Add to architecture diagram in `01-overview-architecture.md`
   - Add credentials to `06-web-uis.md` (if has web UI)

---

### Adding a New Kafka Topic

1. **Edit `kafka/entrypoint.sh`**:
   ```bash
   TOPICS="user.events auth.events transaction.events NEW_TOPIC.events"
   ```

2. **Restart Kafka**:
   ```bash
   docker compose restart kafka
   ```

3. **Verify topic created**:
   ```bash
   docker compose exec kafka /opt/kafka/bin/kafka-topics.sh --list --bootstrap-server localhost:9092
   ```

4. **Update documentation**:
   - Add to Kafka Topics table in `03-message-brokers.md`

---

### Adding a New Volume

1. **Add to `docker-compose.yml` volumes section**:
   ```yaml
   volumes:
     new-volume-name:
   ```

2. **Reference in service**:
   ```yaml
   services:
     <service>:
       volumes:
         - new-volume-name:/path/in/container
   ```

3. **Update documentation**:
   - Add to volumes table in `05-environment-config.md`

---

### Adding a New Environment Variable

1. **Add to root `.env` file**:
   ```env
   NEW_VAR_NAME=value
   ```

2. **Add to `.env.example`** with placeholder:
   ```env
   NEW_VAR_NAME=<description_or_example>
   ```

3. **Reference in `docker-compose.yml`**:
   ```yaml
   environment:
     - NEW_VAR_NAME=${NEW_VAR_NAME}
   ```

4. **If needed by Rust app, add to `rust/entrypoint.sh`** sync section:
   ```bash
   echo "NEW_VAR_NAME=${NEW_VAR_NAME}" >> blazing_sun/.env
   ```

5. **Update documentation**:
   - Add to environment variables section in `05-environment-config.md`

---

### Adding SSL Certificates (Production)

**For custom certificates**:
```bash
# Copy certificate files to nginx container
docker cp your-cert.pem rust-nginx-1:/etc/nginx/ssl/cert.pem
docker cp your-key.pem rust-nginx-1:/etc/nginx/ssl/key.pem

# Restart nginx
docker compose restart nginx
```

**For Let's Encrypt (recommended)**:

1. **Update `nginx/default.conf.template`** to include ACME challenge:
   ```nginx
   location /.well-known/acme-challenge/ {
       root /var/www/certbot;
   }
   ```

2. **Add certbot service to `docker-compose.yml`**:
   ```yaml
   certbot:
     image: certbot/certbot:latest
     volumes:
       - ./nginx/ssl:/etc/letsencrypt
       - ./nginx/certbot:/var/www/certbot
     entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
   ```

3. **Run initial certificate generation**:
   ```bash
   docker compose run --rm certbot certonly --webroot \
       --webroot-path=/var/www/certbot \
       -d your-domain.com \
       -d www.your-domain.com \
       --email your-email@example.com \
       --agree-tos \
       --no-eff-email
   ```

---

### Adding Monitoring for New Service

1. **Add Prometheus scrape target** to `prometheus/prometheus.yml`:
   ```yaml
   scrape_configs:
     - job_name: 'new-service'
       static_configs:
         - targets: ['172.28.0.XX:METRICS_PORT']
   ```

2. **Restart Prometheus**:
   ```bash
   docker compose restart prometheus
   ```

3. **Create Grafana dashboard** (optional):
   - Access Grafana at https://localhost/grafana/
   - Create new dashboard
   - Export JSON and save to `grafana/dashboards/`

---

### Adding Database Migration

1. **Enter Rust container**:
   ```bash
   docker compose exec rust bash
   cd blazing_sun
   ```

2. **Create migration**:
   ```bash
   sqlx migrate add <migration_name>
   ```

3. **Edit migration file** in `migrations/` directory

4. **Run migration**:
   ```bash
   sqlx migrate run
   ```

5. **Prepare SQLx metadata** (if using queries in code):
   ```bash
   cargo sqlx prepare
   ```

6. **Exit and rebuild**:
   ```bash
   exit
   docker compose restart rust
   ```

---

## Scaling Considerations

### Horizontal Scaling

To run multiple instances of the Rust application:

1. **Use load balancer** (Nginx or external)
2. **Externalize sessions** (already using Redis)
3. **Handle file uploads** (use S3 instead of local storage)
4. **Kafka consumer groups** (automatic load balancing)
5. **RabbitMQ worker scaling** (automatic load distribution)

### Vertical Scaling

Adjust resource limits in `docker-compose.yml`:

```yaml
services:
  rust:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

---

## Production Checklist

- [ ] Replace self-signed SSL certificates with valid certificates
- [ ] Change all default passwords in `.env`
- [ ] Enable firewall rules (see `firewall-setup.sh`)
- [ ] Set `BUILD_ENV=prod` in `.env`
- [ ] Configure log rotation for container logs
- [ ] Set up automated backups for PostgreSQL
- [ ] Configure S3 for file uploads (update `blazing_sun/.env`)
- [ ] Set up monitoring alerts in Grafana
- [ ] Review and adjust resource limits
- [ ] Enable Redis persistence if needed
- [ ] Configure Kafka retention policies
- [ ] Set up automated SSL renewal (Let's Encrypt)
- [ ] Review and adjust CORS settings in Rust app
- [ ] Enable rate limiting in Nginx
- [ ] Set up log aggregation (ELK stack or similar)
